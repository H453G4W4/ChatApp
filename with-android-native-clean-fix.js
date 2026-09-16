const { createRunOncePlugin, withAppBuildGradle } = require('@expo/config-plugins');

// `./gradlew clean` fails at `:app:externalNativeBuildCleanDebug`.
//
// Why: AGP's external-native clean task shells out to `ninja clean` inside
// `app/.cxx/<variant>/<hash>/<abi>`. Ninja re-checks its globbed inputs first,
// which re-runs CMake, which reads the generated
// `app/build/generated/autolinking/src/main/jni/Android-autolinking.cmake`.
// That file `add_subdirectory(...)`s each autolinked module's codegen JNI output
// under `node_modules/<module>/android/build/generated/source/codegen/jni/`.
//
// In the same `clean` invocation Gradle runs each library module's own `clean`
// first (observed: `:react-native-async-storage_async-storage:clean` executes
// well before `:app:externalNativeBuildCleanDebug`), deleting exactly those
// directories. CMake then aborts with:
//   add_subdirectory given source ".../codegen/jni/" which is not an existing
//   directory
// AsyncStorage is only the first one reported - 15 of the 25 autolinked entries
// point at codegen output that `clean` removes, so the failure is not specific
// to that module.
//
// Fix: delete the whole `.cxx` tree before the native clean task's action runs.
// The task still runs and still leaves nothing stale behind - `.cxx` holds every
// object file, shared library and ninja/CMake cache that `ninja clean` would
// have removed, and removing the directory outright also drops the stale CMake
// cache, so the next build reconfigures from scratch. With `.cxx` absent the
// task finds nothing to clean and completes normally instead of reconfiguring
// CMake against deleted sources.
//
// Applied to every `externalNativeBuildClean*` task, so debug and release
// variants behave identically.
const MARKER = 'with-android-native-clean-fix';

const CLEAN_BLOCK = `
// >>> ${MARKER}: make \`gradlew clean\` survive RN codegen deletion.
// AGP's externalNativeBuildClean* tasks run \`ninja clean\`, which re-runs CMake
// over Android-autolinking.cmake. Library \`clean\` tasks earlier in the same
// build have already deleted the codegen JNI directories that file references,
// so CMake aborts. Dropping .cxx first removes everything those tasks would
// have cleaned (objects, .so files and the CMake/ninja cache) and leaves them
// with nothing to reconfigure.
tasks.matching { it.name.startsWith("externalNativeBuildClean") }.configureEach {
  doFirst {
    delete("\${projectDir}/.cxx")
  }
}
// <<< ${MARKER}
`;

const withAndroidNativeCleanFix = config =>
  withAppBuildGradle(config, cfg => {
    if (cfg.modResults.language !== 'groovy') {
      throw new Error(`${MARKER}: cannot patch non-groovy app build.gradle`);
    }
    if (!cfg.modResults.contents.includes(MARKER)) {
      cfg.modResults.contents += CLEAN_BLOCK;
    }
    return cfg;
  });

module.exports = createRunOncePlugin(withAndroidNativeCleanFix, MARKER, '1.0.0');
