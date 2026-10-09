import {test,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {requestJson} from '../src/api.js';
const originalFetch=globalThis.fetch;
afterEach(()=>{globalThis.fetch=originalFetch});
function reply(body,status=200){globalThis.fetch=async()=>new Response(body,{status})}
test('empty proxy error has a readable service message',async()=>{reply('',502);await assert.rejects(requestJson('/api/records'),/temporarily unavailable/)});
test('HTML error never exposes a JSON parsing failure',async()=>{reply('<html>Bad gateway</html>',500);await assert.rejects(requestJson('/api/records'),/temporarily unavailable/)});
test('empty and truncated success responses have a readable error',async()=>{for(const body of ['', '{"reservations":']){reply(body);await assert.rejects(requestJson('/api/records'),/incomplete response/)}});
test('server validation messages are preserved',async()=>{reply(JSON.stringify({message:['Email is required.','Accept the terms.']}),400);await assert.rejects(requestJson('/api/reservations'),/Email is required. Accept the terms./)});
test('unauthorized status is preserved for admin sign-in',async()=>{reply('',401);await assert.rejects(requestJson('/api/admin/records'),e=>e.status===401&&/sign in again/.test(e.message))});
test('network failure is readable',async()=>{globalThis.fetch=async()=>{throw new TypeError('Failed to fetch')};await assert.rejects(requestJson('/api/records'),/cannot be reached/)});
test('valid records and no-content responses are supported',async()=>{reply(JSON.stringify({reservations:[],reports:[],utilization:[]}));assert.deepEqual(await requestJson('/api/records'),{reservations:[],reports:[],utilization:[]});reply(null,204);assert.equal(await requestJson('/api/example'),null)});
