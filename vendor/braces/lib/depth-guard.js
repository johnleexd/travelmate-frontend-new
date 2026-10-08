'use strict';

const MAX_DEPTH = 64;
const MAX_NODES = 65536;

exports.assertPatternDepth = input => {
  if (typeof input !== 'string') throw new TypeError('Expected a string');
  if (input.length > MAX_NODES) throw new Error('Brace pattern exceeds the supported length');
  const stack = [];
  const pairs = { ')': '(', '}': '{', ']': '[' };
  for (let index = 0; index < input.length; index++) {
    const character = input[index];
    if (character === '\\') { index++; continue; }
    if (character === '(' || character === '{' || character === '[') {
      stack.push(character);
      if (stack.length > MAX_DEPTH) throw new Error('Brace pattern exceeds the supported nesting depth');
    } else if (pairs[character] === stack[stack.length - 1]) {
      stack.pop();
    }
  }
};

// Explicit stack: inspecting an attacker-supplied AST must not itself recurse.
exports.assertAstDepth = root => {
  const stack = [{ node: root, depth: 0, exit: false }];
  const ancestors = new Set();
  let count = 0;
  while (stack.length) {
    const { node, depth, exit } = stack.pop();
    if (!node || typeof node !== 'object') continue;
    if (exit) { ancestors.delete(node); continue; }
    if (depth > MAX_DEPTH || ++count > MAX_NODES || ancestors.has(node)) {
      throw new Error('Brace AST exceeds the supported depth or size, or contains a cycle');
    }
    ancestors.add(node);
    const parents = new Set();
    let parent = node;
    while (parent && typeof parent === 'object' && parent.parent) {
      if (parents.has(parent) || parents.size > MAX_DEPTH) throw new Error('Brace AST parent chain exceeds the supported depth or contains a cycle');
      parents.add(parent);
      parent = parent.parent;
    }
    stack.push({ node, depth, exit: true });
    if (Array.isArray(node.nodes)) {
      if (node.nodes.length > MAX_NODES) throw new Error('Brace AST exceeds the supported size');
      for (let index = node.nodes.length - 1; index >= 0; index--) stack.push({ node: node.nodes[index], depth: depth + 1, exit: false });
    }
  }
};
