import { createApp } from './bootstrap';

async function main() {
  const { app } = await createApp();
  const port = Number(process.env.PORT || 4000);
  await app.listen(port, '0.0.0.0');
  console.log(`SUPER WHITE API đang chạy: http://localhost:${port}`);
}
main();
