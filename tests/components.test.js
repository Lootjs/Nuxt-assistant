import { beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { setupPanelDom } from './helpers/panel-dom.js';
import { normalizeProps, renderComponents } from '../src/tabs/components.js';

beforeEach(() => setupPanelDom());

const card = name => [...document.querySelectorAll('#componentsList .tabbed-card')]
    .find(element => element.querySelector('.tabbed-card__header').textContent === `<${name}>`);
const tableRows = element => [...element.querySelectorAll('tr')]
    .map(row => [...row.children].map(cell => cell.textContent));

test('normalizes props declared as an array', () => {
    assert.deepEqual(normalizeProps(['keypath', 'plural']), [
        { name: 'keypath', type: 'any', required: false, defaultValue: '' },
        { name: 'plural', type: 'any', required: false, defaultValue: '' },
    ]);
});

test('normalizes props declared with types only', () => {
    assert.deepEqual(normalizeProps({ replace: 'Boolean', to: 'String | Object', date: 'Function<Temporal>' }), [
        { name: 'replace', type: 'Boolean', required: false, defaultValue: '' },
        { name: 'to', type: 'String | Object', required: false, defaultValue: '' },
        { name: 'date', type: 'Temporal', required: false, defaultValue: '' },
    ]);
});

test('normalizes props declared with options', () => {
    assert.deepEqual(normalizeProps({
        to: { type: 'String | Object', required: true },
        ariaCurrentValue: { type: 'String', default: 'page' },
        viewTransition: { type: 'Boolean', default: false },
        options: { type: 'Object', default: 'Function<default>' },
        factory: { type: 'Function', default: 'Function<>' },
        anything: {},
    }), [
        { name: 'to', type: 'String | Object', required: true, defaultValue: '' },
        { name: 'ariaCurrentValue', type: 'String', required: false, defaultValue: '"page"' },
        { name: 'viewTransition', type: 'Boolean', required: false, defaultValue: 'false' },
        { name: 'options', type: 'Object', required: false, defaultValue: 'default()' },
        { name: 'factory', type: 'Function', required: false, defaultValue: 'anonymous()' },
        { name: 'anything', type: 'any', required: false, defaultValue: '' },
    ]);
    assert.deepEqual(normalizeProps(undefined), []);
});

test('renders a props table per component, without internals like compatConfig or setup', () => {
    renderComponents([{
        name: 'RouterLink',
        compatConfig: { MODE: 3 },
        setup: 'Function<setup>',
        props: { to: { type: 'String | Object', required: true }, ariaCurrentValue: { type: 'String', default: 'page' } },
    }]);

    assert.deepEqual(tableRows(card('RouterLink')), [
        ['Prop', 'Type', 'Required', 'Default'],
        ['to', 'String | Object', 'required', ''],
        ['ariaCurrentValue', 'String', '', '"page"'],
    ]);
    assert.doesNotMatch(card('RouterLink').textContent, /compatConfig|setup/);
});

test('shows emits and components without props', () => {
    renderComponents([
        { name: 'i18n-t', props: ['keypath'], emits: ['update', 'close'] },
        { name: 'Dialog', props: {}, emits: { confirm: null, cancel: 'Function<validator>' } },
        { name: 'ClientOnly' },
    ]);

    const emits = name => [...card(name).querySelectorAll('.chip')].map(chip => chip.textContent);
    assert.deepEqual(emits('i18n-t'), ['update', 'close']);
    assert.deepEqual(emits('Dialog'), ['confirm', 'cancel']);
    assert.equal(card('Dialog').querySelector('table'), null);
    assert.equal(card('ClientOnly'), undefined);
    assert.equal(document.getElementById('components-subtitle').textContent,
        'Globally registered components: 3. Auto-imported components of the project are not listed');
});

const namesCard = title => [...document.querySelectorAll('#componentsList .component-card--names')]
    .find(element => element.querySelector('.tabbed-card__header').textContent.startsWith(title));
const chipNames = element => [...element.querySelectorAll('.chip')].map(chip => chip.textContent);

test('lists components without details and lazy ones that are not loaded yet in compact cards', () => {
    renderComponents([
        { name: 'RouterLink', props: { to: 'String' } },
        { name: 'ClientOnly', loaded: true },
        { name: 'NuxtLoadingIndicator', props: {}, emits: [] },
        ...Array.from({ length: 30 }, (_, index) => ({ name: `LazyBlock${index}`, lazy: true, loaded: false })),
        { name: 'LazyCard', lazy: true, loaded: true, props: { size: { type: 'Number', default: 1 } } },
    ]);

    assert.deepEqual([...document.querySelectorAll('#componentsList > .tabbed-card:not(.component-card--names) .tabbed-card__header')]
        .map(header => header.firstChild.textContent), ['<RouterLink>', '<LazyCard>']);
    assert.equal(document.querySelector('.component-card__lazy').textContent, 'lazy');

    assert.equal(namesCard('Without props').querySelector('.tabbed-card__header').textContent, 'Without props (2)');
    assert.deepEqual(chipNames(namesCard('Without props')), ['<ClientOnly>', '<NuxtLoadingIndicator>']);
    assert.equal(namesCard('Lazy, not loaded yet').querySelector('.tabbed-card__header').textContent, 'Lazy, not loaded yet (30)');
    assert.equal(chipNames(namesCard('Lazy, not loaded yet')).length, 30);

    assert.equal(document.getElementById('components-subtitle').textContent,
        'Globally registered components: 34. 30 lazy ones are not loaded yet. Auto-imported components of the project are not listed');
    assert.doesNotMatch(document.getElementById('componentsList').textContent, /false/);
});

test('inserts names from the page as text', () => {
    renderComponents([{ name: '<img src=x onerror=alert(1)>', props: { '<b>prop</b>': 'String' } }]);

    assert.equal(document.querySelector('#componentsList img'), null);
    assert.equal(document.querySelector('#componentsList b'), null);
});
