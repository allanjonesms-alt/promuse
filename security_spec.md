# Security Spec

## Invariants
1. Only users verified in `/admins/` (based on auth.token.email) can modify admins, victims, occurrences or hearings.
2. The user `allanjonesms@gmail.com` is a bootstrapped admin.
3. Victims can be read/updated by admins.
4. Panic Alerts can be created by anyone (anonymous/victims), since currently they might not have formal auth set up in the app, but they should only be readable and updateable by admins.
5. Occurrences are create/read/update by admins.
6. Hearings are create/read/update by admins.

## "Dirty Dozen" Payloads (examples we must protect against)
1. Ghost update adding "status: 'Resolvido'" when they are not an admin.
2. Read all victims without being an admin.
3. Spoof email by not having `email_verified == true`.
etc.
