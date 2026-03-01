# eleventy-test
 Multi-configuration testing for Eleventy plugins!
 
- Build using **multiple Eleventy versions & configurations** for your tests (called *scenarios*) seperately
- Returns the **file contents per scenario** output for easy access during testing, with **caching** for repeated usage.
- Compatible with **any test framework or method**: [configure your directory and use one function]((#using-the-plugin)), that's it!
- **Automatic installation** of either the **latest/specific or specific Eleventy versions** (*unless* they are found *locally*).
- Aside from the Eleventy versions used to test, this package itself has **zero dependencies** when installing.

Want to see how it is in action? For you [dogfooding](https://en.wikipedia.org/wiki/Eating_your_own_dog_food) fans, you can see this library in action in this [library's tests](tests/)!

## How-to
### Using the plugin
Important concepts:
- **Input** refers to an --input dir for Eleventy. For example, your tests' index.njk and stylesheet.css will be in an input dir
- **Scenario** refers to a specific test scenario: with its own Eleventy version & config files (.eleventy.js). Optionally, a scenario can have its own input dir

1. Install the plugin
   ```sh
   npm install --save-dev eleventy-test
   yarn add -D eleventy-test
   ```
2. Create a `tests/` directory in your package root
    ```sh
    # Example structure:
    {project root}/
        package.json
        tests/
    ```
2. Optionally, create the `tests/input/` directory: a global input that scenarios will use if they don't have their own input dir
    ```sh
    # Example structure:
    {project root}/
        package.json
        tests/
            input/
                index.njk
                stylesheet.css
    ```
3. Create the `tests/scenarios/` dir. This is where you'll configure your different scenarios
    ```sh
    # Example structure:
    {project root}/
        package.json
        tests/
            input/
                index.njk
                stylesheet.css
            scenarios/
    ```
4. Create a subdirectory for each scenario you wish to set up:
    - The directory name should start with the *exact* (1.0.2) or *major* (1) version of Eleventy you want to use
    - Optionally, a label can be added
    - The format should be one of the following (or see [this library for examples](tests/scenarios/)):
        - `3.1.2--custom-label/`
        - `3.0.0/`
        - `2--example-label/`
        - `3.1.2/`
    ```sh
    # Example structure:
    {project root}/
        package.json
        tests/
            input/
                index.njk
                stylesheet.css
            scenarios/
                # Will use Eleventy 3.1.2
                3.1.2/
                # Will use latest Eleventy 2.X
                2--no-njk/
    ```
5. Add an Eleventy configuration file to each scenario, and optionally* an `input/` directory
    ```
    # Example structure:
    {project root}/
        package.json
        tests/
            input/
                index.njk
                stylesheet.css
            scenarios/
                3.1.2/
                    .eleventy.js
                2--no-njk/
                    # This scenario will use its own input dir instead of the global one
                    input/
                        index.html
                        index.css
                    .eleventy.js
    ```
    *In case you don't have a global input dir configured, each scenario will need to have its own

6. Within your testing framework of choice, simply run the `buildScenarios` function. This will handle installing the right Eleventy version(s) and reading + caching the file contents back to you. 
    ```js
    import { buildScenarios } from "eleventy-test";
    import test from "ava";

    const results = await buildScenarios({
        returnArray: false,  // return as dict instead of array
        enableDebug: false
    });

    test("Check if index.html is consistent across builds", async t => {
        t.deepEqual(
            await results["3.1.2"].getFileContent("/index.html"), 
            await results["2--no-njk"].getFileContent("/index.html"));
    });
    ```

> Note: you might want to add `eleventy-test-out/` to your .gitignore file!

### Run/develop/test locally
This require Node.js & yarn to be installed.
```bash
git clone https://github.com/Denperidge/eleventy-test
cd eleventy-test
yarn install

yarn watch  # Build & watch for changes. Should be active during development/testing of eleventy-test
yarn build  # Build
yarn start  # Run built js as module (see bottom of index.ts require.main === module)
yarn test  # Using the built js, run the tests from tests/test.mjs
```

## Explanation
### Why?
Eleventy is hands-down my favourite static site generator. I also make [plugins for it](https://github.com/search?q=owner%3ADenperidge%20topic%3Aeleventy-plugin&type=repositories)! So [after a while of brute forcing my Eleventy testing for different setups](https://github.com/Denperidge/eleventy-auto-cache-buster/blob/14787bebe3bb73f4c6bd971196f3bec87812044f/tests/.eleventy.js), I thought an easier solution should exist. Hopefully this is that!

## License
This project is licensed under the [MIT License](LICENSE).
