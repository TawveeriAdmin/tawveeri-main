import { loadStoreConfig } from '../config/scraper-config';
import { GenericHtmlStoreScraper } from './generic-html-store-scraper';

export class AlghanimScraper extends GenericHtmlStoreScraper {
  constructor() {
    super(loadStoreConfig('alghanim'));
  }
}
