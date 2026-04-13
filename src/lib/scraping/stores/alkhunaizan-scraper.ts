import { loadStoreConfig } from '../config/scraper-config';
import { GenericHtmlStoreScraper } from './generic-html-store-scraper';

export class AlkhunaizanScraper extends GenericHtmlStoreScraper {
  constructor() {
    super(loadStoreConfig('alkhunaizan'));
  }
}
