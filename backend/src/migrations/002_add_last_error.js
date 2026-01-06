// Migration to add last_error column for connection error visibility
const addLastErrorColumn = `
-- Add last_error column to sql_instances table
ALTER TABLE sql_instances ADD COLUMN last_error TEXT;
`;

module.exports = { addLastErrorColumn };
