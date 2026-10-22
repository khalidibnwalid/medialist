import express from 'express';

const handler = express();
// uploaded files get unique names and are never overwritten, so they can be cached for good
// (lets browsers & the mobile app show them offline without revalidating)
const staticRoute = express.static('./public/users', { immutable: true, maxAge: '365d' });
handler.use('/api/file', staticRoute);

export default handler;

export const config = {
    api: { externalResolver: true }
}
