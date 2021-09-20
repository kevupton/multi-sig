import { ethers } from 'hardhat';
import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { BigNumberish, Contract } from 'ethers';

chai.should();
chai.use(chaiAsPromised);

describe('MultiSigWallet', () => {
  let multiSigWallet: Contract;
  let dummyToken: Contract;
  let adminAddresses: SignerWithAddress[];
  let signers: SignerWithAddress[];
  let minApprovers: number;
  let tokenOwner: SignerWithAddress;
  let to: SignerWithAddress;

  beforeEach(async () => {
    minApprovers = 2;
    signers = await ethers.getSigners();
    adminAddresses = signers.splice(0, 3);
    to = signers.splice(0, 1)[0]!;
    tokenOwner = signers.splice(0, 1)[0]!;

    const MultiSigWallet = await ethers.getContractFactory('MultiSigWallet');
    multiSigWallet = await MultiSigWallet.deploy(adminAddresses.map(signer => signer.address), minApprovers);

    const DummyToken = await ethers.getContractFactory('DummyToken');
    dummyToken = await DummyToken.connect(tokenOwner).deploy();
  });

  it('should be able to instantiate', async () => {
    expect(multiSigWallet).not.to.be.undefined;
  });

  describe('transfer', () => {

    beforeEach(async () => {
      await to.sendTransaction({
        value: ethers.utils.parseEther('1'),
        to: multiSigWallet.address,
      });
    });

    it('should be able to successfully transfer some funds', async () => {
      const prevWalletBalance = await multiSigWallet['balance']();
      const prevAccountBalance = await to.getBalance();

      const amount = ethers.utils.parseEther('0.5');

      await multiSigWallet['transfer'](to.address, amount);

      const requestId = await multiSigWallet['lastRequestId']();

      await multiSigWallet.connect(adminAddresses[0]!)['approve'](requestId);

      let walletBalance = await multiSigWallet['balance']();
      let accountBalance = await to.getBalance();

      expect(walletBalance.sub(prevWalletBalance)).to.equal(0);
      expect(accountBalance.sub(prevAccountBalance)).to.equal(0);

      await multiSigWallet.connect(adminAddresses[1]!)['approve'](requestId);

      walletBalance = await multiSigWallet['balance']();
      accountBalance = await to.getBalance();

      expect(prevWalletBalance.sub(walletBalance)).to.equal(amount);
      expect(accountBalance.sub(prevAccountBalance)).to.equal(amount);
    });

    it('should fail if they do not have enough funds', async () => {
      const amount = ethers.utils.parseEther('1.5');
      await multiSigWallet['transfer'](to.address, amount).should.eventually.be.rejected;
    });

    it('should not be able to make the request if they are not an admin', async () => {
      await multiSigWallet.connect(to)['transfer'](to, ethers.utils.parseEther('1')).should.eventually.be.rejected;
    });
  });

  describe('transferToken', () => {

    let amount: BigNumberish;

    beforeEach(async () => {
      amount = ethers.utils.parseEther('1');
      await dummyToken['transfer'](multiSigWallet.address, amount);
    });

    it('should fail if there is not enough tokens', async () => {
      await multiSigWallet['transferToken'](multiSigWallet.address, ethers.utils.parseEther('1.5'), dummyToken.address).should.eventually.be.rejected;
    });

    it('should be able to successfully transfer a token', async () => {
      const prevWalletBalance = await multiSigWallet['tokenBalance'](dummyToken.address);
      const prevAccountBalance = await dummyToken['balanceOf'](to.address);

      const amount = ethers.utils.parseEther('0.5');

      await multiSigWallet['transferToken'](to.address, amount, dummyToken.address);

      const requestId = await multiSigWallet['lastRequestId']();

      await multiSigWallet.connect(adminAddresses[0]!)['approve'](requestId);

      let walletBalance = await multiSigWallet['tokenBalance'](dummyToken.address);
      let accountBalance = await dummyToken['balanceOf'](to.address);

      expect(walletBalance.sub(prevWalletBalance)).to.equal(0);
      expect(accountBalance.sub(prevAccountBalance)).to.equal(0);

      await multiSigWallet.connect(adminAddresses[1]!)['approve'](requestId);

      walletBalance = await multiSigWallet['tokenBalance'](dummyToken.address);
      accountBalance = await dummyToken['balanceOf'](to.address);

      expect(prevWalletBalance.sub(walletBalance)).to.equal(amount);
      expect(accountBalance.sub(prevAccountBalance)).to.equal(amount);
    });

    it('should not be callable if they are not an admin', async () => {
      await multiSigWallet.connect(to)['transferToken'](to.address, amount, dummyToken.address).should.eventually.be.rejected;
    });
  });

  describe('functionCall', () => {
    let amount: BigNumberish;

    beforeEach(async () => {
      amount = ethers.utils.parseEther('1');
      await dummyToken['transfer'](multiSigWallet.address, amount);
    });

    it('should fail if the call fails', async () => {
      const encoding: string = dummyToken.interface.encodeFunctionData('transfer', [to.address, ethers.utils.parseEther('1.5')]);

      await multiSigWallet['functionCall'](dummyToken.address, encoding);

      const requestId = multiSigWallet['lastRequestId']();

      await multiSigWallet.connect(adminAddresses[0]!)['approve'](requestId);
      await multiSigWallet.connect(adminAddresses[1]!)['approve'](requestId).should.eventually.be.rejected;
    });

    it('should be able to successfully call another contract', async () => {
      const encoding: string = dummyToken.interface.encodeFunctionData('transfer', [to.address, ethers.utils.parseEther('0.5')]);

      await multiSigWallet['functionCall'](dummyToken.address, encoding);

      const requestId = multiSigWallet['lastRequestId']();

      await multiSigWallet.connect(adminAddresses[0]!)['approve'](requestId);
      await multiSigWallet.connect(adminAddresses[1]!)['approve'](requestId);

      expect(await dummyToken['balanceOf'](to.address)).to.equal(ethers.utils.parseEther('0.5'));
    });

    it('should not be able to make the request if they are not an admin', async () => {
      const encoding: string = dummyToken.interface.encodeFunctionData('transfer', [to.address, ethers.utils.parseEther('0.5')]);
      await multiSigWallet.connect(to)['functionCall'](dummyToken.address, encoding).should.eventually.be.rejected;
    });
  });

  describe('addAdmin', () => {

    it('should add an admin to the total amount of admins', async () => {

      await multiSigWallet['admin'](to.address).should.eventually.equal(false);

      await multiSigWallet['addAdmin'](to.address);

      const requestId = multiSigWallet['lastRequestId']();
      await multiSigWallet.connect(adminAddresses[0]!)['approve'](requestId);
      await multiSigWallet.connect(adminAddresses[1]!)['approve'](requestId);

      await multiSigWallet['admin'](to.address).should.eventually.equal(true);
      await multiSigWallet['totalAdmins']().should.eventually.equal(4);
    });

    it('should fail if they are already an admin', async () => {
      await multiSigWallet['addAdmin'](adminAddresses[0]!.address).should.eventually.be.rejected;
    });

    it('should fail if they are not an admin', async () => {
      await multiSigWallet.connect(to)['addAdmin'](to.address).should.eventually.be.rejected;
    });
  });

  describe('revokeAdmin', () => {

    it('should add an admin to the total amount of admins', async () => {

      await multiSigWallet['admin'](adminAddresses[0]!.address).should.eventually.equal(true);

      await multiSigWallet['revokeAdmin'](adminAddresses[0]!.address);

      const requestId = multiSigWallet['lastRequestId']();
      await multiSigWallet.connect(adminAddresses[0]!)['approve'](requestId);
      await multiSigWallet.connect(adminAddresses[1]!)['approve'](requestId);

      await multiSigWallet['admin'](adminAddresses[0]!.address).should.eventually.equal(false);
      await multiSigWallet['totalAdmins']().should.eventually.equal(2);
    });

    it('should fail if they are not currently an admin', async () => {
      await multiSigWallet['revokeAdmin'](to.address).should.eventually.be.rejected;
    });

    it('should fail if they are not an admin', async () => {
      await multiSigWallet.connect(to)['revokeAdmin'](adminAddresses[0]!.address).should.eventually.be.rejected;
    });
  });

  describe('updateRequiredApprovals', () => {

    it('should only be callable from an admin', async () => {
      await multiSigWallet.connect(to)['updateRequiredApprovals'](3).should.eventually.be.rejected;
    });

    it('should be able to successfully call', async () => {

      await multiSigWallet['requiredApprovals']().should.eventually.equal(2);

      await multiSigWallet['updateRequiredApprovals'](3);

      const requestId = multiSigWallet['lastRequestId']();
      await multiSigWallet.connect(adminAddresses[0]!)['approve'](requestId);
      await multiSigWallet.connect(adminAddresses[1]!)['approve'](requestId);

      await multiSigWallet['requiredApprovals']().should.eventually.equal(3);
    });

    it('should fail if they try and set it to more than the amount of admins', async () => {
      await multiSigWallet['updateRequiredApprovals'](5).should.eventually.be.rejected;
    });

    it('should never be more than the total amount of admins', async () => {

      await multiSigWallet['requiredApprovals']().should.eventually.equal(2);

      await multiSigWallet['updateRequiredApprovals'](3);

      let requestId = multiSigWallet['lastRequestId']();
      await multiSigWallet.connect(adminAddresses[0]!)['approve'](requestId);
      await multiSigWallet.connect(adminAddresses[1]!)['approve'](requestId);

      await multiSigWallet['requiredApprovals']().should.eventually.equal(3);

      await multiSigWallet['revokeAdmin'](adminAddresses[0]!.address);

      requestId = multiSigWallet['lastRequestId']();
      await multiSigWallet.connect(adminAddresses[0]!)['approve'](requestId);
      await multiSigWallet.connect(adminAddresses[1]!)['approve'](requestId);

      await multiSigWallet['totalAdmins']().should.eventually.equal(3);

      await multiSigWallet.connect(adminAddresses[2]!)['approve'](requestId);

      await multiSigWallet['totalAdmins']().should.eventually.equal(2);
      await multiSigWallet['requiredApprovals']().should.eventually.equal(2);
    });
  });
});
