SELECT u."id", u.username, u."displayName", u.email, r.name AS roleName, u."isActive" FROM users u LEFT JOIN roles r ON u."roleId" = r.id ORDER BY u.id;
