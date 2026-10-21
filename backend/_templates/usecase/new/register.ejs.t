---
echo: |

  Generated src/usecases/<%= base %>/<%= feature %>/<%= method %>/. Register it in <%= moduleFile %>:

    import { <%= h.changeCase.pascal(feature) %>Controller } from '~usecases/<%= base %>/<%= feature %>/<%= method %>/<%= feature %>.controller';
    import { <%= h.changeCase.pascal(feature) %>Repository } from '~usecases/<%= base %>/<%= feature %>/<%= method %>/<%= feature %>.repository';
    import { <%= h.changeCase.pascal(feature) %>Usecase } from '~usecases/<%= base %>/<%= feature %>/<%= method %>/<%= feature %>.usecase';

    controllers: [..., <%= h.changeCase.pascal(feature) %>Controller],
    providers: [..., <%= h.changeCase.pascal(feature) %>Usecase, <%= h.changeCase.pascal(feature) %>Repository],

  Then replace the example fields (dto, response, repository), add the contract to shared/contracts,
  write the real e2e scenarios and run `npm run lint && npm test`.
---
