import { ethers } from 'hardhat';
import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { Contract } from 'ethers';

chai.should();
chai.use(chaiAsPromised);

describe("MultiSigWallet", () => {
  let multiSigWallet: Contract;
  let adminAddresses: SignerWithAddress[];
  let signers: SignerWithAddress[];
  let minApprovers: number;
  let to: SignerWithAddress;

  beforeEach(async () => {
    minApprovers = 2;
    signers = await ethers.getSigners();
    adminAddresses = signers.splice(0, 3);
    to = signers.splice(0, 1)[0]!;

    const MultiSigWallet = await ethers.getContractFactory('MultiSigWallet');
    multiSigWallet = await MultiSigWallet.deploy(adminAddresses.map(signer => signer.address), minApprovers);
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
  });
  
  describe('transferToken', () => {
    
  });

  describe('functionCall', () => {
    
  });

  describe('addAdmin', () => {
    
  });

  describe('revokeAdmin', () => {
    
  });

  describe('updateRequiredApprovals', () => {

  });
});
