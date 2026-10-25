import test from 'node:test'
import assert from 'node:assert/strict'
import { LAYOUTS, buildNetwork, layerReveal, nextQuality, projectNetwork, sceneQuality } from './neural-net.js'

test('network has the requested layers and valid, forward-only edges', () => {
  for (const layout of Object.values(LAYOUTS)) {
    const net = buildNetwork(layout)
    assert.equal(net.nodes.length, layout.reduce((sum, count) => sum + count, 0))
    assert.ok(net.edges.length >= net.nodes.length - layout[0])
    for (const [from, to] of net.edges) {
      assert.equal(net.nodes[to].layer, net.nodes[from].layer + 1)
    }
    // у каждого нейрона после входного слоя есть вход, у каждого до выходного — выход
    net.nodes.forEach((node, index) => {
      if (node.layer > 0) assert.ok(net.edges.some(([, to]) => to === index), `node ${index} has no input`)
      if (node.layer < layout.length - 1) assert.ok(net.outgoing[index].length > 0, `node ${index} has no output`)
    })
  }
})

test('network is deterministic and light layout is smaller', () => {
  assert.deepEqual(buildNetwork(LAYOUTS.full), buildNetwork(LAYOUTS.full))
  assert.ok(buildNetwork(LAYOUTS.light).edges.length < buildNetwork(LAYOUTS.full).edges.length)
  assert.notDeepEqual(buildNetwork(LAYOUTS.full, { seed: 1 }).nodes, buildNetwork(LAYOUTS.full, { seed: 2 }).nodes)
})

test('projection stays finite, near nodes are larger and rotation moves points', () => {
  const net = buildNetwork(LAYOUTS.full)
  const flat = projectNetwork(net, { yaw: 0, pitch: 0 })
  const turned = projectNetwork(net, { yaw: 1, pitch: -0.3 })
  for (const view of [flat, turned]) {
    for (let i = 0; i < net.nodes.length; i += 1) {
      assert.ok(Number.isFinite(view.sx[i]) && Number.isFinite(view.sy[i]) && view.scale[i] > 0)
      assert.ok(view.depth[i] >= 0 && view.depth[i] <= 1)
    }
  }
  assert.notEqual(flat.sx[0], turned.sx[0])
  const order = [...net.nodes.keys()].sort((a, b) => flat.depth[a] - flat.depth[b])
  assert.ok(flat.scale[order.at(-1)] >= flat.scale[order[0]])
})

test('layers assemble left to right', () => {
  assert.equal(layerReveal(0, 0, 5), 0)
  assert.equal(layerReveal(1, 4, 5), 1)
  assert.ok(layerReveal(0.3, 0, 5) > layerReveal(0.3, 3, 5))
})

test('quality follows device and degrades on slow frames', () => {
  assert.equal(sceneQuality({ allowed3d: true, lite: false, reduced: false }), 'full')
  assert.equal(sceneQuality({ allowed3d: false, lite: false, reduced: false }), 'light')
  assert.equal(sceneQuality({ allowed3d: true, lite: true, reduced: false }), 'still')
  assert.equal(sceneQuality({ allowed3d: true, lite: false, reduced: true }), 'still')
  assert.equal(nextQuality('full', 12), 'full')
  assert.equal(nextQuality('full', 30), 'light')
  assert.equal(nextQuality('light', 20), 'light')
  assert.equal(nextQuality('light', 60), 'still')
  assert.equal(nextQuality('still', 100), 'still')
})
