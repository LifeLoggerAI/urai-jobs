import admin from 'firebase-admin'
import { Timestamp } from 'firebase-admin/firestore'
import { RoleDoc, PermissionDoc } from '../../types/index.js.js.js.js'

if (!admin.apps.length) {
  admin.initializeApp()
}
const db = admin.firestore()

const permissions: PermissionDoc[] = [
  { permissionId: 'jobs.create', description: 'Create jobs' },
  { permissionId: 'jobs.read.own', description: 'Read own jobs' },
  { permissionId: 'jobs.read.any', description: 'Read any jobs' },
  { permissionId: 'jobs.cancel.own', description: 'Cancel own jobs' },
  { permissionId: 'jobs.cancel.any', description: 'Cancel any jobs' },
  { permissionId: 'admin.roles.read', description: 'Read role and permission docs' },
  { permissionId: 'system.worker', description: 'Run worker operations' }
]

const roles: RoleDoc[] = [
  {
    roleId: 'admin',
    description: 'Administrative user',
    permissions: permissions.map((p) => p.permissionId)
  },
  {
    roleId: 'client',
    description: 'Standard client user',
    permissions: ['jobs.create', 'jobs.read.own', 'jobs.cancel.own']
  },
  {
    roleId: 'worker',
    description: 'System worker',
    permissions: ['system.worker', 'jobs.read.any']
  },
  {
    roleId: 'viewer',
    description: 'Read-only support operator',
    permissions: ['jobs.read.any', 'admin.roles.read']
  }
]

async function run() {
  const now = Timestamp.now().toDate().toISOString()
  for (const permission of permissions) {
    await db.collection('permissions').doc(permission.permissionId).set({
      ...permission,
      updatedAt: now
    }, { merge: true })
  }

  for (const role of roles) {
    await db.collection('roles').doc(role.roleId).set({
      ...role,
      updatedAt: now
    }, { merge: true })
  }

  console.log('[PASS] seeded roles and permissions')
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
