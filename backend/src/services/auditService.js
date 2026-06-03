async function writeAudit(client, req, action, entity, entityId, metadata = {}) {
  await client.query(
    `INSERT INTO audit_logs (user_id, action, entity, entity_id, metadata, ip_address, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      req.user?.id || null,
      action,
      entity,
      entityId ? String(entityId) : null,
      metadata,
      req.ip || null,
      req.get('user-agent') || null
    ]
  );
}

module.exports = { writeAudit };
