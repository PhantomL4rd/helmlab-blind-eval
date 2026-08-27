import { mount } from 'svelte';
import Analysis from './Analysis.svelte';
import './app.css';

const target = document.getElementById('app');
if (!target) throw new Error('#app not found');

export default mount(Analysis, { target });
