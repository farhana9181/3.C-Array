//Find largest and smallest number using array.
#include<stdio.h>
void main(){
int num[100],i,n,lar, small;
printf("How many numbers you want to input = ");
scanf("%d",&n);
printf("Enter  %d  numbers  =\n",n);
for(i=0;i<n;i++)
{
    printf("num[%d] =",i);
    scanf("%d",&num[i]);
}
printf("All numbers are = \n");
for(i=0;i<n;i++)
{
    printf("%d \t ",num[i]);
}

lar= num[0];
for(i=0;i<n;i++)
{
    if((num[i] )> lar )
    {
        lar =num[i];
    }
}
 printf("\nThe largest number  = %d\n", lar);

 small= num[0];
for(i=0;i<n;i++)
{
    if((num[i] ) <  small)
    {
        small =num[i];
    }
}
 printf("The smallest number  = %d", small);

}
