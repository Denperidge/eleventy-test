# eleventy-test
Eleventy is hands-down my favourite static site generator. I also make [plugins for it](https://github.com/search?q=owner%3ADenperidge%20topic%3Aeleventy-plugin&type=repositories)! So [after a while of brute forcing my Eleventy testing](https://github.com/Denperidge/eleventy-auto-cache-buster/tree/14787bebe3bb73f4c6bd971196f3bec87812044f/tests), I thought an easier solution should exist. Hopefully this is that!
- Build using multiple Eleventy versions & configurations for your tests (called scenarios) seperately. Returns the file contents per scenario output for easy access during testing.
- Compatible with any test framework or method.
- Automatic installation of latest/specific Eleventy version (if not found locally).
- Aside from the Eleventy versions used to test, this package itself has **zero** dependencies when installing.

Want to see how it is in action? For the dogfooding fans, you can see this library in action in this [library's tests](tests/)!

## How-to
### Use the plugin
1. Install the plugin
   ```bash
   npm install --save-dev eleventy-test
   yarn add -D eleventy-test
   ```
2. Create `${projectRoot}/tests/scenarios/`
3. Create a subdirectory for each scenario you wish to set up. The directory name should start with the *exact* (1.0.2) or *major* (1) version. The format should be one of the following:
    - `${projectRoot}/tests/scenarios/${eleventyVersion}--${label}/`
    - `${projectRoot}/tests/scenarios/${eleventyVersion}/`
3. Add an Eleventy configuration file to the scenario
4. Use the buildScenarios function and its output as needed
    ```js
    import { buildScenarios } from "eleventy-test";
    import test from "ava";

    const resultsAsDict = await buildScenarios({
        projectRoot: cwd(),
        returnArray: false,
        enableDebug: false
    });

    test("Check if index.html is consistent across builds", async t => {
        t.deepEqual(
            await results["3--example"].getFileContent("/index.html"), 
            await results["3.0.0--identical-example"].getFileContent("/index.html"));
    });
    ```

And that's it! eleventy-test will handle installing the right versons and reading (and caching) the file contents back to you.


> Note: you might want to add `eleventy-test-out/` to your .gitignore file!

### Run/develop/test locally
This require Node.js & yarn to be installed.
```bash
git clone https://github.com/Denperidge/eleventy-test
cd eleventy-test
yarn install

yarn watch  # Watch for changes
yarn build  # Build
yarn start  # Run built js as module (see bottom of index.ts require.main === module)
yarn test  # Run the tests from tests/test.mjs
```

## License
This project is licensed under the [MIT License](LICENSE).
