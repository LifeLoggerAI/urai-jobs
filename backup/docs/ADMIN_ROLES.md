# URAI Admin Roles & Permissions

Access to the admin system is strictly controlled through a role-based system.

## Roles

- **Viewer:** Can read most data but cannot make any changes. This role is for auditing and review purposes only.
- **Reviewer:** Can perform Class 1 and Class 2 actions. This includes viewing applications, changing application statuses, and adding internal notes.
- **Admin:** Can perform all actions of a Reviewer, plus manage job postings. Can perform *some* Class 3 actions, but not those related to user access.
- **Owner:** The highest level of privilege. Can do everything an Admin can do, plus manage admin access itself (granting/revoking roles). This role is reserved for a very small, designated number of individuals.

## Rules of Access

1.  **No Shared Accounts:** Every admin must have their own individual account.
2.  **Principle of Least Privilege:** Users are granted the lowest level of access required to perform their duties.
3.  **No Default Admin:** New users are never granted admin access by default.
4.  **No Wildcard Permissions:** All permissions are explicitly defined. There are no `*` or wildcard rules.
