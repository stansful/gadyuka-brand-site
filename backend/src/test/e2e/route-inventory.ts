import { RequestMethod, Type } from '@nestjs/common';
import { MetadataScanner, ModulesContainer, ReflectableDecorator, Reflector } from '@nestjs/core';

import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { Module } from '@nestjs/core/injector/module';

/** A route handler: the controller method Nest calls. */
export type RouteHandler = (...args: never[]) => unknown;

/** One HTTP route of the running app, as Nest registered it. */
export interface ApiRoute {
  /** Class name of the module that declares the controller */
  readonly module: string;
  readonly controller: Type;
  readonly handler: RouteHandler;
  /** "GET", "POST" … */
  readonly method: string;
  /** Full declared path ("/api/v1/auth/login", "/media/*") */
  readonly path: string;
}

interface RouteCandidate {
  readonly module: string;
  readonly controller: Type;
  readonly handler: unknown;
}

/**
 * Every route of a running app, read from the Nest module tree (controllers + route metadata), and
 * the access metadata the global guards read — so a test can check a rule for ALL routes, including
 * the ones added later.
 */
export class RouteInventory {
  private static readonly PARAMETER = /:[^/]+|\*/g;
  private readonly scanner = new MetadataScanner();
  private readonly reflector = new Reflector();

  constructor(private readonly modules: ModulesContainer) {}

  list(): ApiRoute[] {
    return [...this.modules.values()].flatMap(module => this.routesOfModule(module));
  }

  /** The value of a guard decorator (@Public, @NoInternalKey, @Roles) as the guards resolve it. */
  metadataOf<TParam, TValue>(decorator: ReflectableDecorator<TParam, TValue>, route: ApiRoute): TValue | undefined {
    return this.reflector.getAllAndOverride(decorator, [route.handler, route.controller]);
  }

  /** A concrete URL of the route: every ":param" / "*" replaced by a sample segment. */
  samplePathOf(route: ApiRoute): string {
    return route.path.replace(RouteInventory.PARAMETER, 'sample');
  }

  private routesOfModule(module: Module): ApiRoute[] {
    return [...module.controllers.values()].flatMap(({ metatype }) =>
      typeof metatype === 'function' ? this.routesOfController(module.metatype.name, metatype as Type) : [],
    );
  }

  private routesOfController(module: string, controller: Type): ApiRoute[] {
    const prototype: object = controller.prototype;
    return this.scanner
      .getAllMethodNames(prototype)
      .flatMap(name => this.routeOf({ module, controller, handler: Reflect.get(prototype, name) }));
  }

  private routeOf({ module, controller, handler }: RouteCandidate): ApiRoute[] {
    if (!this.isHandler(handler) || typeof Reflect.getMetadata(PATH_METADATA, handler) !== 'string') {
      return [];
    }
    const method: RequestMethod = Reflect.getMetadata(METHOD_METADATA, handler);
    const path = this.fullPathOf(controller, Reflect.getMetadata(PATH_METADATA, handler));
    return [{ module, controller, handler, method: RequestMethod[method], path }];
  }

  private fullPathOf(controller: Type, handlerPath: string): string {
    const controllerPath: unknown = Reflect.getMetadata(PATH_METADATA, controller);
    const base = typeof controllerPath === 'string' ? controllerPath : '';
    return `/${base}/${handlerPath}`.replace(/\/{2,}/g, '/');
  }

  private isHandler(value: unknown): value is RouteHandler {
    return typeof value === 'function';
  }
}
