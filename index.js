const commander = require('commander');
const { name, version } = require('./package.json');
const packageJson = require('package-json');
const childProcess = require('child_process');
const path = require('path');
const fs = require('fs');
const { edit } = require('ut-form-jsonschema');
const glob = require('glob');
const UtLog = require('ut-log');
const log = new UtLog({
    type: 'bunyan',
    name: 'create-ut',
    service: 'create-ut',
    version,
    streams: []
}).createLog('info', {name: 'create-ut', context: 'create-ut'});

function exec(command, args, options) {
    const res = childProcess.spawnSync(command, args, options);

    if (res.stderr) console.error(res.stderr.toString().trim());

    if (res.error) {
        console.error('git', 'clone', url, dir, '=>');
        console.error(res.error);
        return process.exit(1);
    }

    if (res.status !== 0) {
        console.error('git', 'clone', url, dir, '=>', res.status);
        return process.exit(1);
    }

    return res.stdout;
}

async function run() {
    let template, dir, root;

    try {
        const program = new commander.Command(name)
            .version(version)
            .description('UT generator')
            .arguments('[template] [project-directory]')
            .allowUnknownOption()
            .usage('[template] [project-directory]')
            .action((tmpl = 'app', prjDir = '.') => {
                const [prefix] = tmpl.split('-');
                switch(prefix) {
                    case 'ms':
                    case 'service':
                        tmpl = tmpl.replace(prefix, 'microservice');
                        break;
                    case 'port':
                        tmpl = tmpl.replace(prefix, 'port-template');
                        break;
                    default:
                        break;
                }
                template = 'ut-' + tmpl;
                dir = prjDir;
                root = path.join(process.cwd(), dir);
            })
            .parse(process.argv);

        const { repository: { url } } = await packageJson(template, {registryUrl: 'https://nexus.softwaregroup.com/repository/npm-all/'});

        exec('git', ['clone', url, dir], {stdio: 'inherit'});

        const create = require(path.join(root, 'create.js'));

        if (create.schema.properties.userName) {
            const userEmail = exec('git', ['config', '--get', 'user.email'], {stdio: 'pipe', encoding: 'utf-8'});
            create.formSchema = {
                ...create.formSchema,
                userName: userEmail.split('@')[0]
            },
        }

        const {url: { href }, id} = await edit({log});

        childProcess.exec((process.platform == 'win32' ? 'start' : 'xdg-open') + ' ' + href, err => {
            if (err) {
                console.error(err);
                console.log('Open configuration form at:', href);
            }
        });

        const data = await edit({ ...params, id, log });
        const rules = rename(data);

        rules.forEach(({files, replace}) => {
            const list = glob.sync(/^[^/\\].*/.test(files) ? '/' + files : files, { root });
            list.forEach(file => {
                const fileContent = fs.readFileSync(file, 'utf8');
                // [regExp1, value1] or [regExp1, value1, regExp2, value2] or [[regExp1, value1], [regExp2, value2]]
                replace
                    .flat()
                    .reduce((all, item, i) => all.concat(i % 2 ? [[all.pop(), item]] : item), [])
                    .forEach(([regExp, value]) => fileContent.replace(regExp, value))
                fs.writeFileSync(file, fileContent);
            });
        });

        console.log(`${template} based project has been successfully created in folder ${root}!`);
    } catch(e) {
        console.error(e);
        process.exit(1);
    }
}

run();
