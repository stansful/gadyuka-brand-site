// hygen usecase new [--group public|admin|auth] [--slice catalog] [--feature news-items] [--method get|post|put|patch|delete]
// Asks only for what was not passed on the command line. --slice (optional, never asked): the folder of a
// slice feature module under the group (src/usecases/<group>/<slice>/<feature>/<method>/).
const GROUPS = ['public', 'admin', 'auth'];
const METHODS = ['get', 'post', 'put', 'patch', 'delete'];
const FEATURE = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

module.exports = {
  prompt: async ({ prompter, args }) => {
    const answers = { ...args };
    if (!GROUPS.includes(answers.group)) {
      answers.group = (await prompter.prompt({ type: 'select', name: 'group', message: 'API group', choices: GROUPS })).group;
    }
    answers.slice = FEATURE.test(answers.slice ?? '') ? answers.slice : '';
    answers.base = answers.slice === '' ? answers.group : `${answers.group}/${answers.slice}`;
    answers.moduleFile =
      answers.slice === '' ? `src/usecases/${answers.group}/${answers.group}.module.ts` : `your slice module, src/usecases/${answers.base}/*.module.ts`;
    if (!FEATURE.test(answers.feature ?? '')) {
      const question = { type: 'input', name: 'feature', message: 'Feature (kebab-case, e.g. news-items)', validate: value => FEATURE.test(value) || 'kebab-case: a-z, 0-9, single hyphens' };
      answers.feature = (await prompter.prompt(question)).feature;
    }
    if (!METHODS.includes(answers.method)) {
      answers.method = (await prompter.prompt({ type: 'select', name: 'method', message: 'HTTP method', choices: METHODS })).method;
    }
    return answers;
  },
};
