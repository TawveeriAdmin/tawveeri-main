import { loadStoreConfig } from '../config/scraper-config';
import { GenericHtmlStoreScraper } from './generic-html-store-scraper';

export class BukhamsenScraper extends GenericHtmlStoreScraper {
  constructor() {
    super(loadStoreConfig('bukhamsen'));
  }
}
