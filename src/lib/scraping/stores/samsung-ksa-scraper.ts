import { loadStoreConfig } from '../config/scraper-config';
import { GenericHtmlStoreScraper } from './generic-html-store-scraper';

export class SamsungKsaScraper extends GenericHtmlStoreScraper {
  constructor() {
    super(loadStoreConfig('samsung_ksa'));
  }
}
