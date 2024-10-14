import { StorageService } from './StorageService';
import { LinkManager } from './LinkManager';
import { UI } from './UI';
import { Item } from './Item';

const storageService = new StorageService<Item>('links');
const linkManager = new LinkManager(storageService);
const ui = new UI(linkManager);
