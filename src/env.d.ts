declare namespace App {
  interface Locals {
    project?: import('./lib/posts').Post['data']['project'];
  }
}
