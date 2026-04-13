import { loadStoreConfig } from '../config/scraper-config';
import { GenericHtmlStoreScraper } from './generic-html-store-scraper';

export class LuluGccScraper extends GenericHtmlStoreScraper {
  constructor() {
    super(loadStoreConfig('lulu_gcc'));
  }
}
