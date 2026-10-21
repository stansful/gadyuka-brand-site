/** The seed needs the admin account from the environment. */
export class AdminCredentialsMissingError extends Error {
  constructor() {
    super('ADMIN_LOGIN and ADMIN_PASSWORD must be set (.env) to seed the admin account');
    this.name = 'AdminCredentialsMissingError';
  }
}
