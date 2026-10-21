---
to: src/usecases/<%= base %>/<%= feature %>/<%= method %>/<%= feature %>.route.ts
---
import { API_VERSION } from '~usecases/usecase.interfaces';

export const <%= h.changeCase.constant(feature) %>_ROUTE = `${API_VERSION}/<%= group %>/<%= feature %>`;
