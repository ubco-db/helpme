## How to add a new route

1. Add a method to the controller with `@Get` or other http method decorator. To get request body, path params, query params, etc, use decorators on the arguments. [Available decorators](https://docs.nestjs.com/controllers#request-object). Additionally, we have custom decorators `@User` and `@UserId` to get the currently logged in user.
2. If a new controller is needed, use `yarn nest g controller <CONTROLLERNAME>` to auto-generate one.
3. **IMPORTANT** If route/controller is authenticated: `@UseGuards(JwtAuthGuard)`
4. If you want to use database model serialization (`@Expose @Exclude` stuff): `@UseInterceptors(ClassSerializerInterceptor)`

## How to run Nest code as a script

This should rarely be needed, but stuff like manually trigger cron jobs or creating admin users is a good reason for a CLI script.

1. Create a new command `.command.ts` file in an appropriate module. Look at `src/admin/admin.command.ts` for reference (this file has since been deleted but feel free to look at commit history).
2. Add it as a provider to its module.

More info: https://www.npmjs.com/package/nestjs-command
