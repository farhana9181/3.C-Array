#include<stdio.h>
void main(){
int A[100],p,n,q,t;
printf("How many elements =");
scanf("%d",&n);
printf("Enter the elements are = \n");
for(p=0;p<n;p++)
{

    //printf("A[%d] =",p);

    scanf("%d",&A[p]);
}
 printf("A[%d] =",p);

for(p=0;p<n;p++)
{
  for(q=p+1;q<n;q++)
  {
    if(A[p]>A[q])
    {
      t=A[p];
      A[p]=A[q];
      A[q]=t;
    }
  }
}

   printf("\n After sorted =  \n");
  for(p=0;p<n;p++)
  {
      printf("%d \t",A[p]);
  }
}
