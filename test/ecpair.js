"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const __1 = require("..");
const __2 = require("..");
const { describe, it, beforeEach } = require('mocha');
const assert = require('assert');
const proxyquire = require('proxyquire');
const hoodwink = require('hoodwink');
const tinysecp = require('tiny-secp256k1');
const fixtures = require('../ts_test/fixtures/ecpair.json');
const NETWORKS_LIST = []; // Object.values(NETWORKS)
for (const networkName in __2.networks) {
    if (networkName)
        NETWORKS_LIST.push(__2.networks[networkName]);
}
const ZERO = Buffer.alloc(32, 0);
const ONE = Buffer.from('0000000000000000000000000000000000000000000000000000000000000001', 'hex');
const GROUP_ORDER = Buffer.from('fffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141', 'hex');
const GROUP_ORDER_LESS_1 = Buffer.from('fffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364140', 'hex');
describe('ECPair', () => {
    describe('getPublicKey', () => {
        let keyPair;
        beforeEach(() => {
            keyPair = __1.ECPair.fromPrivateKey(ONE);
        });
        it('calls pointFromScalar lazily', hoodwink(() => {
            // @ts-ignore
            assert.strictEqual(keyPair.__Q, undefined);
            // .publicKey forces the memoization
            assert.strictEqual(keyPair.publicKey.toString('hex'), '0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798');
            assert.strictEqual(
            // @ts-ignore
            keyPair.__Q.toString('hex'), '0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798');
        }));
    });
    describe('fromPrivateKey', () => {
        it('defaults to compressed', () => {
            const keyPair = __1.ECPair.fromPrivateKey(ONE);
            assert.strictEqual(keyPair.compressed, true);
        });
        it('supports the uncompressed option', () => {
            const keyPair = __1.ECPair.fromPrivateKey(ONE, {
                compressed: false,
            });
            assert.strictEqual(keyPair.compressed, false);
        });
        it('supports the network option', () => {
            const keyPair = __1.ECPair.fromPrivateKey(ONE, {
                compressed: false,
                network: __2.networks.testnet,
            });
            assert.strictEqual(keyPair.network, __2.networks.testnet);
        });
        fixtures.valid.forEach(f => {
            it('derives public key for ' + f.WIF, () => {
                const d = Buffer.from(f.d, 'hex');
                const keyPair = __1.ECPair.fromPrivateKey(d, {
                    compressed: f.compressed,
                });
                assert.strictEqual(keyPair.publicKey.toString('hex'), f.Q);
            });
        });
        fixtures.invalid.fromPrivateKey.forEach(f => {
            it('throws ' + f.exception, () => {
                const d = Buffer.from(f.d, 'hex');
                assert.throws(() => {
                    // @ts-ignore
                    __1.ECPair.fromPrivateKey(d, f.options);
                }, new RegExp(f.exception));
            });
        });
    });
    describe('fromPublicKey', () => {
        fixtures.invalid.fromPublicKey.forEach(f => {
            it('throws ' + f.exception, () => {
                const Q = Buffer.from(f.Q, 'hex');
                assert.throws(() => {
                    __1.ECPair.fromPublicKey(Q, f.options);
                }, new RegExp(f.exception));
            });
        });
    });
    describe('fromWIF', () => {
        fixtures.valid.forEach(f => {
            it('imports ' + f.WIF + ' (' + f.network + ')', () => {
                const network = __2.networks[f.network];
                const keyPair = __1.ECPair.fromWIF(f.WIF, network);
                assert.strictEqual(keyPair.privateKey.toString('hex'), f.d);
                assert.strictEqual(keyPair.compressed, f.compressed);
                assert.strictEqual(keyPair.network, network);
            });
        });
        fixtures.valid.forEach(f => {
            it('imports ' + f.WIF + ' (via list of networks)', () => {
                const keyPair = __1.ECPair.fromWIF(f.WIF, NETWORKS_LIST);
                assert.strictEqual(keyPair.privateKey.toString('hex'), f.d);
                assert.strictEqual(keyPair.compressed, f.compressed);
                assert.strictEqual(keyPair.network, __2.networks[f.network]);
            });
        });
        fixtures.invalid.fromWIF.forEach(f => {
            it('throws on ' + f.WIF, () => {
                assert.throws(() => {
                    const networks = f.network ? __2.networks[f.network] : NETWORKS_LIST;
                    __1.ECPair.fromWIF(f.WIF, networks);
                }, new RegExp(f.exception));
            });
        });
    });
    describe('toWIF', () => {
        fixtures.valid.forEach(f => {
            it('exports ' + f.WIF, () => {
                const keyPair = __1.ECPair.fromWIF(f.WIF, NETWORKS_LIST);
                const result = keyPair.toWIF();
                assert.strictEqual(result, f.WIF);
            });
        });
    });
    describe('makeRandom', () => {
        const d = Buffer.alloc(32, 4);
        const exWIF = 'KwMWvwRJeFqxYyhZgNwYuYjbQENDAPAudQx5VEmKJrUZcq6aL2pv';
        describe('uses randombytes RNG', () => {
            it('generates a ECPair', () => {
                const stub = {
                    randombytes: () => {
                        return d;
                    },
                };
                const ProxiedECPair = proxyquire('../src/ecpair', stub);
                const keyPair = ProxiedECPair.makeRandom();
                assert.strictEqual(keyPair.toWIF(), exWIF);
            });
        });
        it('allows a custom RNG to be used', () => {
            const keyPair = __1.ECPair.makeRandom({
                rng: (size) => {
                    return d.slice(0, size);
                },
            });
            assert.strictEqual(keyPair.toWIF(), exWIF);
        });
        it('retains the same defaults as ECPair constructor', () => {
            const keyPair = __1.ECPair.makeRandom();
            assert.strictEqual(keyPair.compressed, true);
            assert.strictEqual(keyPair.network, __2.networks.bitcoin);
        });
        it('supports the options parameter', () => {
            const keyPair = __1.ECPair.makeRandom({
                compressed: false,
                network: __2.networks.testnet,
            });
            assert.strictEqual(keyPair.compressed, false);
            assert.strictEqual(keyPair.network, __2.networks.testnet);
        });
        it('throws if d is bad length', () => {
            function rng() {
                return Buffer.alloc(28);
            }
            assert.throws(() => {
                __1.ECPair.makeRandom({ rng });
            }, /Expected Buffer\(Length: 32\), got Buffer\(Length: 28\)/);
        });
        it('loops until d is within interval [1, n) : 1', hoodwink(function () {
            const rng = this.stub(() => {
                if (rng.calls === 0)
                    return ZERO; // 0
                return ONE; // >0
            }, 2);
            __1.ECPair.makeRandom({ rng });
        }));
        it('loops until d is within interval [1, n) : n - 1', hoodwink(function () {
            const rng = this.stub(() => {
                if (rng.calls === 0)
                    return ZERO; // <1
                if (rng.calls === 1)
                    return GROUP_ORDER; // >n-1
                return GROUP_ORDER_LESS_1; // n-1
            }, 3);
            __1.ECPair.makeRandom({ rng });
        }));
    });
    describe('.network', () => {
        fixtures.valid.forEach(f => {
            it('returns ' + f.network + ' for ' + f.WIF, () => {
                const network = __2.networks[f.network];
                const keyPair = __1.ECPair.fromWIF(f.WIF, NETWORKS_LIST);
                assert.strictEqual(keyPair.network, network);
            });
        });
    });
    describe('tinysecp wrappers', () => {
        let keyPair;
        let hash;
        let signature;
        beforeEach(() => {
            keyPair = __1.ECPair.makeRandom();
            hash = ZERO;
            signature = Buffer.alloc(64, 1);
        });
        describe('signing', () => {
            it('wraps tinysecp.sign', hoodwink(function () {
                this.mock(tinysecp, 'sign', (h, d) => {
                    assert.strictEqual(h, hash);
                    assert.strictEqual(d, keyPair.privateKey);
                    return signature;
                }, 1);
                assert.strictEqual(keyPair.sign(hash), signature);
            }));
            it('throws if no private key is found', () => {
                // @ts-ignore
                delete keyPair.__D;
                assert.throws(() => {
                    keyPair.sign(hash);
                }, /Missing private key/);
            });
        });
        describe('verify', () => {
            it('wraps tinysecp.verify', hoodwink(function () {
                this.mock(tinysecp, 'verify', (h, q, s) => {
                    assert.strictEqual(h, hash);
                    assert.strictEqual(q, keyPair.publicKey);
                    assert.strictEqual(s, signature);
                    return true;
                }, 1);
                assert.strictEqual(keyPair.verify(hash, signature), true);
            }));
        });
    });
});
