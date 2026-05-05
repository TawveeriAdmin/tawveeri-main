import { loadStoreConfig } from '../config/scraper-config';
import { GenericHtmlStoreScraper } from './generic-html-store-scraper';

export class ShakerScraper extends GenericHtmlStoreScraper {
  constructor() {
    super(loadStoreConfig('shaker'));
  }
}
