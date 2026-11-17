export function fail(status, message) {
  throw Object.assign(new Error(message), { status });
}

export function required(value, label, limit) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > limit) {
    fail(400, label + ' is required and must be at most ' + limit + ' characters.');
  }
  return value.trim();
}

export function integer(value, label, min = 1, max = 2147483647) {
  if (!Number.isInteger(value) || value < min || value > max) {
    fail(400, label + ' must be a whole number from ' + min + ' to ' + max + '.');
  }
  return value;
}

export function choice(value, options, message) {
  if (!options.includes(value)) fail(400, message);
  return value;
}

export async function one(connection, sql, values, message) {
  const [[row]] = await connection.execute(sql, values);
  if (!row) fail(404, message);
  return row;
}
