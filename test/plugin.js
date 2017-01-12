/* @flow */
/* eslint-disable no-sync */

import {
  describe,
  it,
  beforeEach,
  afterEach,
} from 'mocha';

import {
  read,
  transform,
} from './helpers';

import {
  startServer,
  stopServer,
} from '../src/plugin';

import { expect } from 'chai';
import { stub } from 'sinon';
import childProcess from 'child_process';

describe('babel-plugin-transform-postcss', () => {
  beforeEach(() => {
    stub(childProcess, 'spawn').returns({
      unref: stub(),
      kill: stub(),
    });
  });
  afterEach(() => childProcess.spawn.restore());

  beforeEach(() => {
    stub(childProcess, 'execFileSync').returns(
      new Buffer('{"simple":"_simple_jvai8_1"}')
    );
  });
  afterEach(() => childProcess.execFileSync.restore());

  afterEach(() => stopServer());

  const testServerLaunched = () => {
    expect(childProcess.spawn).to.have.been.calledOnce;

    const [executable, args, opts] = childProcess.spawn.getCall(0).args;
    const [jsExecutable, socketPath] = args;

    expect(executable).to.match(/node$/);
    expect(args.length).to.eql(2);
    expect(jsExecutable).to.endWith('/postcss-server.js');
    expect(socketPath).to.match(/^\/tmp.*\.sock$/);
    expect(opts).to.eql({
      env: process.env, // eslint-disable-line no-process-env
      stdio: 'inherit',
    });
  };

  const testClientLaunched = (filename: string) => {
    expect(childProcess.execFileSync).to.have.been.calledOnce;

    const [executable, args, opts] = childProcess.execFileSync.getCall(0).args;
    const [jsExecutable, socketPath, jsonString] = args;
    const json = JSON.parse(jsonString);
    const { cssFile, configFile } = json;

    expect(executable).to.match(/node$/);
    expect(args.length).to.eql(3);
    expect(jsExecutable).to.endWith('/postcss-client.js');
    expect(socketPath).to.match(/^\/tmp.*\.sock$/);
    expect(cssFile).to.endWith(`/${filename}`);
    expect(configFile).to.endWith('/postcss.config.js');
    expect(json).to.have.keys('cssFile', 'configFile');
    expect(opts).to.eql({
      env: process.env, // eslint-disable-line no-process-env
    });
  };

  const shouldBehaveLikeSeverIsRunning = () => {
    describe('when transforming require.js', () => {
      let initialSpwawnCount;

      beforeEach(() => { initialSpwawnCount = childProcess.spawn.callCount; });
      beforeEach(() => transform('require.js'));

      it('does not launch the server again', () => {
        expect(childProcess.spawn.callCount).to.eql(initialSpwawnCount);
      });
    });
  };

  describe('when transforming require.js', () => {
    let result;

    beforeEach(async () => { result = await transform('require.js'); });

    it('launches the server', testServerLaunched);
    it('launches a client', () => testClientLaunched('simple.css'));
    it('compiles correctly', async () => {
      expect(result).to.eql((await read('require.expected.js')).trim());
    });

    shouldBehaveLikeSeverIsRunning();
  });

  describe('when transforming import.js', () => {
    let result;

    beforeEach(async () => { result = await transform('import.js'); });

    it('launches the server', testServerLaunched);
    it('launches a client', () => testClientLaunched('simple.css'));
    it('compiles correctly', async () => {
      expect(result).to.eql((await read('import.expected.js')).trim());
    });

    shouldBehaveLikeSeverIsRunning();
  });

  describe('when transforming nocss.js', () => {
    beforeEach(() => transform('nocss.js'));

    it('does not launch the server', () => {
      expect(childProcess.spawn).to.not.have.been.called;
    });

    it('does not launch a client', () => {
      expect(childProcess.execFileSync).to.not.have.been.called;
    });
  });

  describe('when the server has been started started', () => {
    beforeEach(() => startServer());
    shouldBehaveLikeSeverIsRunning();
  });

  describe('when transforming require.js & the client returns no data', () => {
    let result;

    beforeEach(() => childProcess.execFileSync.returns(new Buffer('')));
    beforeEach(async () => { result = await transform('require.js'); });

    it('compiles correctly', async () => {
      expect(result).to.eql((await read('require.expected.empty.js')).trim());
    });
  });

});
