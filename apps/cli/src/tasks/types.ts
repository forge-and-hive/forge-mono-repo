export interface RunnerDescriptor {
  path: string
  version: string
  upload?: {
    bucket: string
    path: string
  }
}

export interface TaskDescriptor {
  path: string
  handler: string
}

export interface Infra {
  region: string
  bucket: string
}

export interface ForgeConf {
  project: {
    name: string
    uuid?: string
  }
  paths: {
    logs: string
    tasks: string
    runners: string
    fixtures: string
    fingerprints: string
    tests: string
  }
  infra: Infra
  tasks: Record<string, TaskDescriptor>
  runners: Record<string, RunnerDescriptor>
}

export interface TaskName {
  descriptor: string
  taskName: string
  fileName: string
  dir?: string
}

export interface Profile {
  name: string
  apiKey: string
  apiSecret: string
  url: string
}

export interface Profiles {
  default: string
  profiles: Profile[]
}
