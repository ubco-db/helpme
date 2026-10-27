import './instrument';
import { bootstrap } from './bootstrap';

declare const module: any;

void bootstrap(module.hot);
