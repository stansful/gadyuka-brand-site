---
to: src/usecases/<%= base %>/<%= feature %>/<%= method %>/<%= feature %>.e2e.test.ts
---
<%
  const Name = h.changeCase.pascal(feature);
  const ROUTE = h.changeCase.constant(feature) + '_ROUTE';
  const signedIn = group !== 'public';
  const request = method === 'get'
    ? `\`\${${ROUTE}}?example=hello\``
    : ROUTE;
  const options = [method === 'get' ? null : "body: { example: 'hello' }", signedIn ? 'accessToken' : null].filter(Boolean);
-%>
import { strictEqual } from 'node:assert';
import { after, before, describe, it } from 'node:test';

<% if (signedIn) { -%>
import { TestAdmin } from '~test/e2e/test-admin';
<% } -%>
import { TestApp } from '~test/e2e/test-app';

import { <%= Name %>Response } from './<%= feature %>.response';
import { <%= ROUTE %> } from './<%= feature %>.route';

describe('[e2e] <%= method.toUpperCase() %> /api/v1/<%= group %>/<%= feature %>', () => {
  let app: TestApp;
<% if (signedIn) { -%>
  let admin: TestAdmin;
  let accessToken: string;
<% } -%>

  before(async () => {
    app = await TestApp.start();
<% if (signedIn) { -%>
    admin = await TestAdmin.create(app.database);
    accessToken = await admin.signIn(app.api);
<% } -%>
  });

  after(async () => {
<% if (signedIn) { -%>
    await admin.remove();
<% } -%>
    await app.stop();
  });

  it('answers <%= method === 'post' ? 201 : 200 %> with the response (replace with the real scenarios)', async () => {
    const response = await app.api.<%= method %><<%= Name %>Response>(<%= request %><%- options.length ? `, { ${options.join(', ')} }` : '' %>);
    strictEqual(response.status, <%= method === 'post' ? 201 : 200 %>);
    strictEqual(response.body.example.startsWith('hello'), true);
  });
<% if (method !== 'get') { -%>

  it('refuses an invalid body with field message keys', async () => {
    const response = await app.api.<%= method %>(<%= ROUTE %>, { body: { example: 1 }<%- signedIn ? ', accessToken' : '' %> });
    strictEqual(response.status, 400);
  });
<% } -%>
});
