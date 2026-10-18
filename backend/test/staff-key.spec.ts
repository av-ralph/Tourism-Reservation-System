import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AppService } from '../src/app.service.js';
import type { RecordStore } from '../src/record-store.js';
import type { Store } from '../src/record-store.js';

const originalSuperKey = process.env.HM_ADMIN_KEY;
beforeEach(() => { process.env.HM_ADMIN_KEY = 'test-super-admin-key'; });
afterEach(() => { if (originalSuperKey === undefined) delete process.env.HM_ADMIN_KEY; else process.env.HM_ADMIN_KEY = originalSuperKey; });

function service() {
 const data: Store = { reservations: [], reports: [], utilization: [], facilities: [], inventory: [], adminKeys: [], adminProfiles: [], organization: [] };
 const storage = { read: async () => data, mutate: async <T>(change: (records: Store) => T) => change(data) } as RecordStore;
 return { app: new AppService(storage), data };
}

describe('staff access key changes', () => {
 it('stores admin and instructor profiles with database-safe IDs', async () => {
  const { app, data } = service();
  const adminKey = 'AdminPass1!';
  const instructorKey = 'Instructor1!';
  await app.createAdminKey({ name: 'Admin', key: adminKey, role: 'admin' });
  const instructor = await app.createAdminKey({ name: 'Instructor', key: instructorKey, role: 'instructor' });
  await app.updateAdminProfile(`Bearer ${adminKey}`, { name: 'Office Admin', email: '', photo: '' });
  await app.updateAdminProfile(`Bearer ${instructorKey}`, { name: 'Faculty Member', email: '', photo: '' });
  expect(data.adminProfiles).toHaveLength(2);
  expect(data.adminProfiles.every(profile => profile.id.length <= 36)).toBe(true);
  await expect(app.adminIdentity(`Bearer ${adminKey}`)).resolves.toMatchObject({ adminName: 'Office Admin' });
  await expect(app.adminIdentity(`Bearer ${instructorKey}`)).resolves.toMatchObject({ adminName: 'Faculty Member' });
  await app.revokeAdminKey(instructor.id!, 'admin');
  expect(data.adminProfiles).toHaveLength(1);
 });

 it('rotates an instructor key, preserves the profile, and shows the new key to an admin', async () => {
  const { app } = service();
  const adminKey = 'AdminPass1!';
  const oldKey = 'Instructor1!';
  const newKey = 'NewTeacher2@';
  await app.createAdminKey({ name: 'Admin', key: adminKey, role: 'admin' });
  await app.createAdminKey({ name: 'Testing instructor', key: oldKey, role: 'instructor' });
  await app.updateAdminProfile(`Bearer ${oldKey}`, { name: 'Teacher Name', email: '', photo: '' });

  await expect(app.changeStaffKey(`Bearer ${oldKey}`, { currentKey: oldKey, newKey })).resolves.toEqual({ success: true });
  await expect(app.authorizeStaff(`Bearer ${oldKey}`)).rejects.toThrow();
  await expect(app.authorizeStaff(`Bearer ${newKey}`)).resolves.toBe('instructor');
  await expect(app.adminIdentity(`Bearer ${newKey}`)).resolves.toMatchObject({ adminName: 'Teacher Name' });
  const listed = await app.listStaffKeys(`Bearer ${adminKey}`);
  expect(listed.find(row => row.role === 'instructor')).toMatchObject({ key: newKey });
 });

 it('rejects the wrong current key, weak replacements, and duplicate keys', async () => {
  const { app } = service();
  const adminKey = 'AdminPass1!';
  const instructorKey = 'Instructor1!';
  await app.createAdminKey({ name: 'Admin', key: adminKey, role: 'admin' });
  await app.createAdminKey({ name: 'Instructor', key: instructorKey, role: 'instructor' });
  await expect(app.changeStaffKey(`Bearer ${instructorKey}`, { currentKey: 'WrongPass1!', newKey: 'NewTeacher2@' })).rejects.toThrow('current access key is incorrect');
  await expect(app.changeStaffKey(`Bearer ${instructorKey}`, { currentKey: instructorKey, newKey: 'tooweak123' })).rejects.toThrow('10–32 characters');
  await expect(app.changeStaffKey(`Bearer ${instructorKey}`, { currentKey: instructorKey, newKey: adminKey })).rejects.toThrow('already in use');
  await expect(app.authorizeStaff(`Bearer ${instructorKey}`)).resolves.toBe('instructor');
 });

 it('lets an administrator rotate their own key without changing their access level', async () => {
  const { app } = service();
  const oldKey = 'AdminPass1!';
  const newKey = 'ShortAdmin2#';
  await app.createAdminKey({ name: 'Admin', key: oldKey, role: 'admin' });
  await app.changeStaffKey(`Bearer ${oldKey}`, { currentKey: oldKey, newKey });
  await expect(app.authorizeAdmin(`Bearer ${oldKey}`)).rejects.toThrow();
  await expect(app.authorizeAdmin(`Bearer ${newKey}`)).resolves.toBe('admin');
  expect(() => app.createAdminKey({ name: 'Weak', key: 'weakpassword', role: 'instructor' })).toThrow('10–32 characters');
 });

 it('does not rotate the server-managed super administrator key', async () => {
  const { app } = service();
  await expect(app.changeStaffKey('Bearer test-super-admin-key', { currentKey: 'test-super-admin-key', newKey: 'AnotherPass1!' })).rejects.toThrow('server settings');
 });
});
