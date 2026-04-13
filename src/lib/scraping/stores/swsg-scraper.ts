import { loadStoreConfig } from '../config/scraper-config';
import { GenericHtmlStoreScraper } from './generic-html-store-scraper';

export class SwsgScraper extends GenericHtmlStoreScraper {
  constructor() {
    super(loadStoreConfig('swsg'));
  }
}
