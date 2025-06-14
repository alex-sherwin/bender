# Core Ideas

* unix pipe like uni-directional flow
* event-sourced data model to track state
    * time-travel debugging, great for everyone!!
* well-defined DTO between nodes.  should be content agnostic.
    * multipart/mixed HTTP Request
    * tRPC
* "named pipes" for branching/DAG-like behavior
* use vfs
    * memfs / unionfs / linkfs / spyfs
    * use FSA (FileSystem Access API)
    * isomorphic-git can use these
* use MockServiceWorker to mock/simulate network    
* use "content addressable storage"?  probably not, memfs looks really good.
    * for generated files?
    * for input files?
    * for a VFS?
    * claim check'ish pattern?  just file paths?
    * custom URI protocol prefix for non-files?
* runtime / design-time input/output type compatability checking (ArkType should shine here?)
* string/name based type registry
    * built dynamically based on all known transforms?
    * allow for in-browser completion/suggestions/visual builder for inputs/output capabilities
* nodes which are just data (useful for testing)
    * tar.gz of filesystem?

# UI Ideas

* Launch Copilot chat pre-filled prompt with `GET https://github.com/copilot?prompt=test123`