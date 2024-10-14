import { StorageService } from './StorageService.js';
import { LinkManager } from './LinkManager.js';
import { UI } from './UI.js';
const storageService = new StorageService('links');
const linkManager = new LinkManager(storageService);
const ui = new UI(linkManager);
