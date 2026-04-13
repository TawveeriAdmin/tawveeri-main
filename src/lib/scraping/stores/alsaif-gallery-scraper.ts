import { loadStoreConfig } from '../config/scraper-config';
import { GenericHtmlStoreScraper } from './generic-html-store-scraper';

export class AlsaifGalleryScraper extends GenericHtmlStoreScraper {
  constructor() {
    super(loadStoreConfig('alsaif_gallery'));
  }
}
