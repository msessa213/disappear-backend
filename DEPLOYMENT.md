# Deployment Pipeline Setup

## GitHub Actions CI/CD Workflow

The repository now includes automated deployment to AWS ECS via GitHub Actions.

### Workflow Location
`.github/workflows/deploy.yml`

### How It Works
1. **Trigger**: Automatically runs on every push to `main` branch
2. **Build**: Builds Docker image from `./backend/Dockerfile`
3. **Push**: Pushes image to Amazon ECR
4. **Deploy**: Updates ECS service with new image and forces new deployment
5. **Wait**: Monitors ECS until service is stable

### Required GitHub Secrets Configuration

Add these secrets to your GitHub repository settings (`Settings → Secrets and variables → Actions`):

#### `AWS_ROLE_ARN`
Your AWS IAM role ARN for OIDC authentication. Format:
```
arn:aws:iam::ACCOUNT_ID:role/role-name
```

**Why**: GitHub Actions uses OIDC to assume this role instead of storing long-lived AWS credentials.

#### AWS IAM Role Permissions Required
Attach a policy with these permissions:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ecr:GetAuthorizationToken",
        "ecr:BatchCheckLayerAvailability",
        "ecr:GetDownloadUrlForLayer",
        "ecr:PutImage",
        "ecr:InitiateLayerUpload",
        "ecr:UploadLayerPart",
        "ecr:CompleteLayerUpload"
      ],
      "Resource": "arn:aws:ecr:us-east-1:ACCOUNT_ID:repository/disappear-backend"
    },
    {
      "Effect": "Allow",
      "Action": [
        "ecs:DescribeTaskDefinition",
        "ecs:DescribeServices",
        "ecs:DescribeTaskDefinition",
        "ecs:UpdateService",
        "ecs:WaitServicesStable"
      ],
      "Resource": [
        "arn:aws:ecs:us-east-1:ACCOUNT_ID:service/disappear-cluster/disappear-backend-service",
        "arn:aws:ecs:us-east-1:ACCOUNT_ID:task-definition/disappear-backend-task:*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": "iam:PassRole",
      "Resource": [
        "arn:aws:iam::ACCOUNT_ID:role/ecsTaskExecutionRole",
        "arn:aws:iam::ACCOUNT_ID:role/ecsTaskRole"
      ]
    }
  ]
}
```

### Environment Variables (in workflow)
These are configured in the workflow and can be customized:
- `AWS_REGION`: `us-east-1`
- `ECR_REPOSITORY`: `disappear-backend`
- `ECS_SERVICE`: `disappear-backend-service`
- `ECS_CLUSTER`: `disappear-cluster`
- `ECS_TASK_DEFINITION`: `disappear-backend-task`

### To Enable Automated Deployment

1. **Set up OIDC in AWS** (one-time):
   ```bash
   # Create OIDC provider for GitHub
   aws iam create-open-id-connect-provider \
     --url https://token.actions.githubusercontent.com \
     --client-id-list sts.amazonaws.com \
     --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1
   ```

2. **Create IAM Role** with the policy above

3. **Add GitHub Secret**:
   - Go to repo → Settings → Secrets and variables → Actions
   - Click "New repository secret"
   - Name: `AWS_ROLE_ARN`
   - Value: Your IAM role ARN from step 2

4. **Update `.github/workflows/deploy.yml`** with your actual values:
   - AWS_REGION
   - ECR_REPOSITORY
   - ECS_SERVICE
   - ECS_CLUSTER
   - ECS_TASK_DEFINITION

### Testing the Workflow

Push a test commit to `main`:
```bash
git commit --allow-empty -m "test: trigger deployment workflow"
git push origin main
```

Monitor progress in: `GitHub → Actions → Deploy to ECS`

### Troubleshooting

**Workflow fails with "Unable to assume role"**
- Verify `AWS_ROLE_ARN` secret is set correctly
- Ensure OIDC provider exists in AWS account
- Check IAM role trust relationship includes GitHub

**Docker image push fails**
- Verify ECR repository exists
- Check IAM role has ECR permissions
- Confirm AWS_REGION matches ECR repository region

**ECS deployment fails**
- Verify ECS cluster and service names match
- Check task definition exists
- Ensure IAM role has ECS permissions

### Manual Deployment (if needed)

If you need to manually deploy without waiting for GitHub Actions:

```bash
# Build and push Docker image
docker build -t disappear-backend:latest ./backend
aws ecr get-login-password | docker login --username AWS --password-stdin $ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com
docker tag disappear-backend:latest $ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/disappear-backend:latest
docker push $ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/disappear-backend:latest

# Update ECS service
aws ecs update-service \
  --cluster disappear-cluster \
  --service disappear-backend-service \
  --force-new-deployment
```

### What Gets Deployed

The workflow deploys the **backend only**. It includes:
- ✅ Lithic SDK integration for card issuance
- ✅ Enhanced database connection pooling
- ✅ Health check endpoint (`/health`)
- ✅ All PII management endpoints
- ✅ Stripe webhook handlers
- ✅ S3 receipt vaulting

Frontend deployments remain manual (Vercel) until a separate workflow is configured.

---

**Last Updated**: May 27, 2026
**Backend Version**: Latest with Lithic + Connection Pooling + Cyberpunk UI
