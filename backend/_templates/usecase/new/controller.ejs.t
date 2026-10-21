---
to: src/usecases/<%= base %>/<%= feature %>/<%= method %>/<%= feature %>.controller.ts
---
<%
  const Name = h.changeCase.pascal(feature);
  const Verb = h.changeCase.pascal(method);
  const source = method === 'get' ? 'Query' : 'Body';
  const swagger = ['ApiOkResponse', 'ApiOperation', 'ApiTags'].concat(group === 'admin' ? ['ApiBearerAuth'] : []).sort();
-%>
import { <%= source %>, Controller, <%= Verb %> } from '@nestjs/common';
import { <%= swagger.join(', ') %> } from '@nestjs/swagger';
<% if (group === 'admin') { -%>

import { UserRole } from '~core/users/user-role';
import { Roles } from '~decorator';
<% } else if (group === 'public') { -%>

import { Public } from '~decorator';
<% } -%>

import { <%= Name %>Dto } from './<%= feature %>.dto';
import { <%= Name %>Response } from './<%= feature %>.response';
import { <%= h.changeCase.constant(feature) %>_ROUTE } from './<%= feature %>.route';
import { <%= Name %>Usecase } from './<%= feature %>.usecase';

<% if (group === 'admin') { -%>
@ApiBearerAuth()
@Roles([UserRole.ADMIN])
<% } -%>
@Controller()
export class <%= Name %>Controller {
  constructor(private readonly usecase: <%= Name %>Usecase) {}

  @ApiTags('<%= group %>')
  @ApiOperation({ summary: '<%= group %>/<%= feature %>', description: 'What the endpoint does (replace)' })
  @ApiOkResponse({ type: <%= Name %>Response })
<% if (group === 'public') { -%>
  @Public()
<% } -%>
  @<%= Verb %>(<%= h.changeCase.constant(feature) %>_ROUTE)
  async execute(@<%= source %>() dto: <%= Name %>Dto): Promise<<%= Name %>Response> {
    return this.usecase.execute({ example: dto.example });
  }
}
