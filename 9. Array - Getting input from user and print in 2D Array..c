//Getting input from user and print in 2D Array.
#include<stdio.h>
void main (){
int a[5][5], n,i,j;
printf(" How many =");
scanf("%d",&n);
printf("------Enter elements  first  matrix------- \n");
for(i=0; i<n; i++)
{
    for(j=0 ; j< n ; j++)
    {
        printf("a[%d][%d] = ",i,j);
        scanf("%d",&a[i][j]);
    }
}

 printf("----matrix   are --- \n");
for(i=0; i<n; i++)
{
    for(j=0 ; j< n ; j++)
    {
      printf("%d\t",a[i][j]);
    }
    printf("\n");
}
}
