import busboy, { Busboy } from 'busboy';
import { execSync } from 'child_process';
import { Request, Response } from 'express';
import * as fs from 'fs';
import { metacall } from 'metacall';
import * as path from 'path';
// import { Deployment, DeployStatus } from 'metacall-protocol/deployment';

import {
	currentFile,
	deployBody,
	fetchBranchListBody,
	fetchFilesFromRepoBody,
	namearg,
	valueArg
} from './constants';

export const callFnByName = (req: Request, res: Response): Response => {
	if (!(req.params && req.params.name)) {
		return res
			.status(400)
			.send('A function name is required in the path; i.e: /call/sum.');
	}

	const args = Object.values(req.body);

	return res.send(JSON.stringify(metacall(req.params.name, ...args)));
};

export const fetchFiles = (req: Request, res: Response): Busboy => {
	const bb = busboy({ headers: req.headers });
	bb.on('file', (name, file) => {
		const saveTo = path.join('.', name);
		console.log(saveTo);
		file.pipe(fs.createWriteStream(saveTo));
	});

	bb.on('field', (name: namearg, val: valueArg) => {
		currentFile[name] = val;
	});
	bb.on('close', () => {
		currentFile.path = path.join('.', currentFile.id);
		res.end();
	});
	return req.pipe(bb);
};

export const fetchFilesFromRepo = (
	req: Omit<Request, 'body'> & { body: fetchFilesFromRepoBody },
	res: Response
): Response => {
	const { branch, url } = req.body;
	execSync(`git clone --single-branch --depth=1 --branch ${branch} ${url} `);

	const id = dirName(req.body.url);

	currentFile['id'] = id;

	return res.json({ id });
};

export const fetchBranchList = (
	req: Omit<Request, 'body'> & { body: fetchBranchListBody },
	res: Response
): Response => {
	execSync(`git remote add random ${req.body.url} ; git remote update;`);
	const output = execSync(`git branch -r`);
	execSync(`git remote remove random`);

	//clean and prepare output
	const data: string[] = [];
	JSON.stringify(output.toString())
		.split('random/')
		.forEach(msg => {
			if (msg.includes('\\n')) {
				data.push(msg.split('\\n')[0]);
			}
		});

	return res.send({ branches: data });
};

export const fetchFileList = (
	req: Omit<Request, 'body'> & { body: fetchFilesFromRepoBody },
	res: Response
): Response => {
	execSync(`git clone ${req.body.url} --depth=1 --no-checkout`);
	const dir = dirName(req.body.url);
	const output = execSync(
		`cd ${dir} ; git ls-tree -r ${req.body.branch} --name-only; cd .. ; rm -r ${dir}`
	);

	//clean and prepare output
	return res.send({ files: JSON.stringify(output.toString()).split('\\n') });
};
export const deploy = (
	req: Omit<Request, 'body'> & { body: deployBody },
	res: Response
): Response => {
	if (req.body.resourceType == 'Package') {
		installDependencies();
	} else {
		calculatePackages();
	}
	return res.json({});
};

export const showLogs = (req: Request, res: Response): Response => {
	return res.send('Demo Logs...');
};

const dirName = (gitUrl: string): string =>
	String(gitUrl.split('/')[gitUrl.split('/').length - 1]).replace('.git', '');

const installDependencies = () => {
	if (!currentFile.runners) return;
	for (const runner of currentFile.runners) {
		switch (runner) {
			case 'python':
				execSync(
					`cd ${currentFile.id} ; metacall pip3 install -r requirements.txt`
				);
				break;
			case 'nodejs':
				execSync(`cd ${currentFile.id} ; metacall npm i`);
				break;
		}
	}
};

//check if repo contains metacall-*.json if not create and calculate runners then install dependencies
const calculatePackages = () => {
	return true;
};
