import { getDb } from './server/db.ts';
import { crawlAllCitiesGeographic } from './server/cityEventCrawler.ts';

(async () => {
  try {
    console.log('🌍 Starting geographic event crawl...');
    const count = await crawlAllCitiesGeographic();
    console.log('✅ Crawl complete: ' + count + ' events inserted');
    process.exit(0);
  } catch (err) {
    console.error('❌ Crawl error:', err.message);
    process.exit(1);
  }
})();
