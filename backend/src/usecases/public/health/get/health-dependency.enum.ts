/** What the health check pings (named in the log of a dependency that is down, and in the 503 details). */
export enum HealthDependency {
  DATABASE = 'database',
  STORAGE = 'storage',
}
