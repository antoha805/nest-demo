import { SetMetadata } from '@nestjs/common';
import { AppAbility } from './casl-ability.factory';

export type PolicyHandler = (ability: AppAbility) => boolean;

export const CHECK_POLICIES_KEY = 'checkPolicies';

// Checking a class, like can('update', Post), passes if the user can do it to
// any post. Rules that depend on the record are checked once it is loaded.
export const CheckPolicies = (...handlers: PolicyHandler[]) =>
  SetMetadata(CHECK_POLICIES_KEY, handlers);
