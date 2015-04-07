module.exports = function(grunt) {
  grunt.task.registerTask('bump', 'Log stuff.', function(update) {
    var pkg = grunt.file.readJSON('package.json');
    var versions = pkg.version.split('.');
    if(update=="patch") {
      versions[2] = parseInt(versions[2])+1;
    } else if(update=="minor") {
      versions[2] = 0;
      versions[1] = parseInt(versions[1])+1;
    } else if(update=="major") {
      versions[2] = 0;
      versions[1] = 0;
      versions[0] = parseInt(versions[0])+1;
    } else {
      grunt.fail.fatal("Invalid argument");
    }
    pkg.version = versions[0]+'.'+versions[1]+'.'+versions[2];
    grunt.file.write('package.json', JSON.stringify(pkg, null, '  ') + '\n');

    grunt.log.ok("Bumped up the version to "+pkg.version);
  });

  grunt.registerTask('default', 'My "default" task description.', ['bump:patch']);
};
